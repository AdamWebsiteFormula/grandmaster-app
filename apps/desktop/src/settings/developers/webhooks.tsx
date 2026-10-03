import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import {
  commands as webhookCommands,
  type WebhookInfo,
} from "@anlg/plugin-local-api";
import { Copy, Trash } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";
import { toast } from "@anlg/ui/components/ui/toast";
import { cn } from "@anlg/utils";

import { copyText } from "./clipboard";

import { SettingsSectionTitle } from "~/settings/page-title";
import { DestructiveConfirmationDialog } from "~/shared/ui/destructive-confirmation-dialog";

const WEBHOOKS_QUERY_KEY = ["webhooks"] as const;

async function unwrap<T>(
  promise: Promise<
    { status: "ok"; data: T } | { status: "error"; error: string }
  >,
): Promise<T> {
  const result = await promise;
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

export function WebhooksSection() {
  const queryClient = useQueryClient();
  const webhooksQuery = useQuery({
    queryKey: WEBHOOKS_QUERY_KEY,
    queryFn: () => unwrap(webhookCommands.listWebhooks()),
  });
  const createMutation = useMutation({
    mutationFn: (url: string) => unwrap(webhookCommands.createWebhook(url, [])),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WEBHOOKS_QUERY_KEY }),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => unwrap(webhookCommands.deleteWebhook(id)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WEBHOOKS_QUERY_KEY }),
    onError: (error) => toast.error(error.message),
  });
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(webhookCommands.setWebhookActive(id, active)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WEBHOOKS_QUERY_KEY }),
    onError: (error) => toast.error(error.message),
  });
  const testMutation = useMutation({
    mutationFn: (id: string) => unwrap(webhookCommands.testWebhook(id)),
    onSuccess: (delivery) => {
      if (delivery.delivered) {
        toast.success(t`Test delivered (${delivery.status})`);
      } else {
        toast.error(t`Test failed (${delivery.status})`);
      }
      void queryClient.invalidateQueries({ queryKey: WEBHOOKS_QUERY_KEY });
    },
    onError: (error) => toast.error(error.message),
  });

  const form = useForm({
    defaultValues: { url: "" },
    onSubmit: ({ value }) => {
      const url = value.url.trim();
      if (!url) {
        return;
      }
      createMutation.mutate(url);
      form.setFieldValue("url", "");
    },
  });

  const createdWebhook = createMutation.data;
  const webhooks = webhooksQuery.data ?? [];
  const urlInputId = useId();
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookInfo | null>(
    null,
  );

  return (
    <section className="flex flex-col gap-4">
      <SettingsSectionTitle>{t`Webhooks`}</SettingsSectionTitle>
      <div>
        {/* Fork: a visible label, an Upshot placeholder, and a confirm before
            delete (ux-audit-oct3 E, WCAG 4.1.2, NN/g #5). */}
        <label htmlFor={urlInputId} className="mb-2 block text-xs font-medium">
          <Trans>Webhook URL</Trans>
        </label>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="url">
            {(field) => (
              <Input
                id={urlInputId}
                className="h-8 max-w-md text-sm"
                placeholder="https://example.com/webhooks/upshot"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </form.Field>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={createMutation.isPending}
          >
            <Trans>Add webhook</Trans>
          </Button>
        </form>

        {createdWebhook && (
          <div className="border-border bg-muted/30 mt-3 rounded-xl border p-3">
            <p className="text-muted-foreground text-xs">
              <Trans>
                Copy this signing secret now — it is only shown once.
              </Trans>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="bg-muted scrollbar-hide overflow-x-auto rounded-md px-1.5 py-0.5 text-xs">
                {createdWebhook.secret}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0"
                onClick={async () => {
                  if (
                    await copyText(
                      createdWebhook.secret,
                      t`Signing secret copied`,
                    )
                  ) {
                    createMutation.reset();
                  }
                }}
              >
                <Copy className="size-3.5" />
                <Trans>Copy</Trans>
              </Button>
            </div>
          </div>
        )}

        {webhooks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {webhooks.map((webhook) => (
              <WebhookRow
                key={webhook.id}
                webhook={webhook}
                onTest={() => testMutation.mutate(webhook.id)}
                onDelete={() => setWebhookToDelete(webhook)}
                onToggleActive={() =>
                  setActiveMutation.mutate({
                    id: webhook.id,
                    active: !webhook.active,
                  })
                }
                isTesting={testMutation.isPending}
              />
            ))}
          </ul>
        )}
      </div>
      <DestructiveConfirmationDialog
        open={webhookToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setWebhookToDelete(null);
        }}
        title={t`Delete this webhook?`}
        description={t`${webhookToDelete?.url ?? ""} stops receiving events from Upshot.`}
        confirmLabel={t`Delete`}
        pendingLabel={t`Deleting…`}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!webhookToDelete) return;
          deleteMutation.mutate(webhookToDelete.id, {
            onSettled: () => setWebhookToDelete(null),
          });
        }}
      />
    </section>
  );
}

function WebhookRow({
  webhook,
  onTest,
  onDelete,
  onToggleActive,
  isTesting,
}: {
  webhook: WebhookInfo;
  onTest: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  isTesting: boolean;
}) {
  const statusParts = [
    !webhook.active ? t`Paused` : null,
    webhook.events.length > 0 ? webhook.events.join(", ") : t`All events`,
    webhook.last_delivery_at
      ? t`Last delivery ${webhook.last_delivery_status}`
      : null,
  ].filter(Boolean);

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 flex-col">
        <span
          title={webhook.url}
          className={cn([
            "truncate",
            !webhook.active && "text-muted-foreground",
          ])}
        >
          {webhook.url}
        </span>
        <span className="text-muted-foreground text-xs">
          {statusParts.join(" · ")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={onToggleActive}
        >
          {webhook.active ? t`Pause` : t`Resume`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          disabled={isTesting}
          onClick={onTest}
        >
          {t`Test`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive h-7"
          aria-label={t`Delete webhook`}
          onClick={onDelete}
        >
          <Trash className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
