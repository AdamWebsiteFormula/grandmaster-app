use crate::common_derives;
use anlg_askama_utils::filters;

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "title.system.md.jinja")]
    pub struct TitleSystem {
        pub language: Option<String>,
    }
}

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "title.user.md.jinja")]
    pub struct TitleUser {
        pub enhanced_note: String,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anlg_askama_utils::{tpl_assert, tpl_snapshot};

    tpl_assert!(
        test_language_as_specified,
        TitleSystem {
            language: Some("ko".to_string()),
        },
        |v| v.contains("Korean")
    );

    // Fork: generated titles in sentence case, like summary headings
    // (redline2-oct3, R2).
    tpl_assert!(
        test_title_in_sentence_case,
        TitleSystem {
            language: Some("en".to_string()),
        },
        |v| v.contains("Write the title in sentence case")
            && v.contains("not \"Next Steps and Daily Priorities\"")
    );

    tpl_snapshot!(
        test_title_user,
        TitleUser {
            enhanced_note: "".to_string(),
        },
        @"
    <note>

    </note>

    Now, give me SUPER CONCISE title for above note. Only about the topic of the meeting.
    "
    );
}
