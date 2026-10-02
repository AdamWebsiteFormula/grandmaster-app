use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, HeaderName, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use owhisper_client::is_anarlog_pro_openrouter_stt_model;

use super::{AppState, RouteError, make_state, with_common_layers};
use crate::config::SttProxyConfig;
use crate::session_gate::SessionGate;

const TRANSCRIPTION_PATH: &str = "audio/transcriptions";
const FORWARDED_HEADERS: &[&str] = &["http-referer", "x-title", "x-openrouter-categories"];

/// OpenAI-compatible `audio/transcriptions` passthrough to OpenRouter using the
/// server key, restricted to `ANARLOG_PRO_OPENROUTER_STT_MODELS`.
pub fn openrouter_router(config: SttProxyConfig) -> Router {
    let state = make_state(config, SessionGate::new());

    with_common_layers(
        Router::new()
            .route("/audio/transcriptions", post(handler))
            .with_state(state),
    )
}

async fn handler(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    match proxy(&state, &headers, body).await {
        Ok(response) => response,
        Err(error) => error.into_response(),
    }
}

async fn proxy(state: &AppState, headers: &HeaderMap, body: Bytes) -> Result<Response, RouteError> {
    let openrouter = state
        .config
        .openrouter
        .as_ref()
        .ok_or(RouteError::MissingConfig(
            "openrouter_api_key_not_configured",
        ))?;
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| RouteError::BadRequest("missing content-type".to_string()))?
        .to_string();

    let (model, body) = if is_json(&content_type) {
        let (model, body) = json_model(&body)?;
        (model, Bytes::from(body))
    } else if let Some(boundary) = multipart_boundary(&content_type) {
        (multipart_model(&body, &boundary)?, body)
    } else {
        return Err(RouteError::BadRequest(format!(
            "unsupported content-type: {content_type}"
        )));
    };

    if !is_anarlog_pro_openrouter_stt_model(&model) {
        return Err(RouteError::BadRequest(format!(
            "unsupported model: {model}"
        )));
    }

    let _permit = state.try_acquire_batch_slot()?;

    let url = format!(
        "{}/{TRANSCRIPTION_PATH}",
        openrouter.api_base.trim_end_matches('/')
    );
    let mut request = state
        .client
        .post(url)
        .bearer_auth(&openrouter.api_key)
        .header(header::CONTENT_TYPE, content_type);
    for name in FORWARDED_HEADERS {
        if let Some(value) = headers.get(*name) {
            request = request.header(HeaderName::from_static(name), value);
        }
    }

    tracing::info!(model = %model, body_size_bytes = body.len(), "openrouter_stt_request");

    let upstream = request
        .body(body)
        .send()
        .await
        .map_err(|error| RouteError::BadGateway(error.to_string()))?;
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let upstream_content_type = upstream.headers().get(header::CONTENT_TYPE).cloned();
    let bytes = upstream
        .bytes()
        .await
        .map_err(|error| RouteError::BadGateway(error.to_string()))?;

    let mut response = (status, bytes).into_response();
    if let Some(value) = upstream_content_type {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }
    Ok(response)
}

fn is_json(content_type: &str) -> bool {
    content_type
        .split(';')
        .next()
        .is_some_and(|mime| mime.trim().eq_ignore_ascii_case("application/json"))
}

/// Re-serializes the body so the model checked here is the only one forwarded.
fn json_model(body: &[u8]) -> Result<(String, Vec<u8>), RouteError> {
    let value: serde_json::Value = serde_json::from_slice(body)
        .map_err(|error| RouteError::BadRequest(format!("invalid json body: {error}")))?;
    let model = value
        .get("model")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| RouteError::BadRequest("missing model".to_string()))?
        .to_string();
    let body =
        serde_json::to_vec(&value).map_err(|error| RouteError::Internal(error.to_string()))?;
    Ok((model, body))
}

fn multipart_boundary(content_type: &str) -> Option<String> {
    let mut parts = content_type.split(';');
    if !parts
        .next()?
        .trim()
        .eq_ignore_ascii_case("multipart/form-data")
    {
        return None;
    }
    parts.find_map(|param| {
        let (key, value) = param.split_once('=')?;
        key.trim()
            .eq_ignore_ascii_case("boundary")
            .then(|| value.trim().trim_matches('"').to_string())
            .filter(|boundary| !boundary.is_empty())
    })
}

/// Requires exactly one `model` field so the upstream cannot see a different one.
fn multipart_model(body: &[u8], boundary: &str) -> Result<String, RouteError> {
    let invalid = || RouteError::BadRequest("invalid multipart body".to_string());
    let delimiter = format!("--{boundary}");
    let mut models = Vec::new();

    for part in split(body, delimiter.as_bytes()).skip(1) {
        if part.starts_with(b"--") {
            break;
        }
        let part = part.strip_prefix(b"\r\n").ok_or_else(invalid)?;
        let header_end = find(part, b"\r\n\r\n").ok_or_else(invalid)?;
        let part_headers = std::str::from_utf8(&part[..header_end]).map_err(|_| invalid())?;
        if field_name(part_headers).is_some_and(|name| name.eq_ignore_ascii_case("model")) {
            let value = &part[header_end + 4..];
            let value = value.strip_suffix(b"\r\n").unwrap_or(value);
            models.push(
                std::str::from_utf8(value)
                    .map_err(|_| invalid())?
                    .trim()
                    .to_string(),
            );
        }
    }

    match models.as_slice() {
        [model] => Ok(model.clone()),
        [] => Err(RouteError::BadRequest("missing model".to_string())),
        _ => Err(RouteError::BadRequest("duplicate model".to_string())),
    }
}

fn field_name(part_headers: &str) -> Option<&str> {
    let disposition = part_headers.split("\r\n").find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.trim()
            .eq_ignore_ascii_case("content-disposition")
            .then_some(value)
    })?;
    disposition.split(';').skip(1).find_map(|param| {
        let (key, value) = param.split_once('=')?;
        key.trim()
            .eq_ignore_ascii_case("name")
            .then(|| value.trim().trim_matches('"'))
    })
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn split<'a>(mut body: &'a [u8], delimiter: &'a [u8]) -> impl Iterator<Item = &'a [u8]> + 'a {
    let mut done = false;
    std::iter::from_fn(move || {
        if done {
            return None;
        }
        match find(body, delimiter) {
            Some(index) => {
                let (head, tail) = body.split_at(index);
                body = &tail[delimiter.len()..];
                Some(head)
            }
            None => {
                done = true;
                Some(body)
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    fn multipart(fields: &[(&str, &str)]) -> Vec<u8> {
        let mut body = Vec::new();
        for (name, value) in fields {
            body.extend_from_slice(
                format!(
                    "--b\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n"
                )
                .as_bytes(),
            );
        }
        body.extend_from_slice(b"--b--\r\n");
        body
    }

    #[test]
    fn multipart_model_requires_a_single_model_field() {
        assert_eq!(
            multipart_model(
                &multipart(&[("file", "--x"), ("model", "deepgram/nova-3")]),
                "b"
            )
            .unwrap(),
            "deepgram/nova-3"
        );
        assert!(multipart_model(&multipart(&[("file", "x")]), "b").is_err());
        assert!(
            multipart_model(
                &multipart(&[("model", "deepgram/nova-3"), ("MODEL", "openai/whisper-1")]),
                "b"
            )
            .is_err()
        );
    }

    #[test]
    fn multipart_boundary_parses_quoted_values() {
        assert_eq!(
            multipart_boundary("multipart/form-data; boundary=\"abc\"").as_deref(),
            Some("abc")
        );
        assert_eq!(multipart_boundary("application/json"), None);
    }

    #[test]
    fn json_model_forwards_the_checked_model() {
        let (model, body) =
            json_model(br#"{"model":"openai/whisper-1","model":"deepgram/nova-3"}"#).unwrap();
        let forwarded: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(forwarded["model"], model);
    }

    async fn spawn_upstream() -> String {
        let app = Router::new().route(
            "/audio/transcriptions",
            post(|headers: HeaderMap| async move {
                let auth = headers
                    .get(header::AUTHORIZATION)
                    .and_then(|value| value.to_str().ok())
                    .unwrap_or_default()
                    .to_string();
                axum::Json(serde_json::json!({ "text": auth }))
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        format!("http://{addr}")
    }

    fn test_router(api_base: &str) -> Router {
        let supabase = anlg_api_env::SupabaseEnv {
            supabase_url: String::new(),
            supabase_anon_key: String::new(),
            supabase_service_role_key: String::new(),
        };
        openrouter_router(
            SttProxyConfig::new(&crate::env::Env::default(), &supabase)
                .with_openrouter("server-key")
                .with_openrouter_api_base(api_base),
        )
    }

    fn request(model: &str) -> Request<Body> {
        Request::post("/audio/transcriptions")
            .header(header::CONTENT_TYPE, "multipart/form-data; boundary=b")
            .header(header::AUTHORIZATION, "Bearer user-token")
            .body(Body::from(multipart(&[
                ("model", model),
                ("file", "audio"),
            ])))
            .unwrap()
    }

    #[tokio::test]
    async fn forwards_curated_models_with_the_server_key() {
        let router = test_router(&spawn_upstream().await);

        let response = router.oneshot(request("deepgram/nova-3")).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["text"], "Bearer server-key");
    }

    #[tokio::test]
    async fn rejects_models_outside_the_curated_list() {
        let router = test_router(&spawn_upstream().await);

        let response = router.oneshot(request("openai/whisper-1")).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
