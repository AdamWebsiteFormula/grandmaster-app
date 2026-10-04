import { Trans, useLingui } from "@lingui/react/macro";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useId } from "react";

import { Button } from "@anlg/ui/components/ui/button";
import { Input } from "@anlg/ui/components/ui/input";
import { Textarea } from "@anlg/ui/components/ui/textarea";
import { toast } from "@anlg/ui/components/ui/toast";

import { formatProfilePhone } from "./phone";

import { useAuth } from "~/auth";
import { ContactOrganizationSelector } from "~/contacts/details";
import { ProfilePhoto } from "~/contacts/profile-photo";
import {
  type HumanRecord,
  savePersonalContact,
  usePersonalContact,
  useOrganizations,
} from "~/contacts/queries";
import { SettingsGroup } from "~/settings/setting-row";
import { useOwnerUserId } from "~/shared/owner-user";
import { isMac } from "~/shared/shortcut-label";
import { useUpshotAccount } from "~/upshot-plan";

export function AccountProfile() {
  const auth = useAuth();
  const localOwnerUserId = useOwnerUserId();
  const humanId = auth.session?.user.id ?? localOwnerUserId;
  if (!humanId)
    return (
      <p role="status">
        <Trans>Loading…</Trans>
      </p>
    );
  return <ProfileLoader key={humanId} humanId={humanId} />;
}

function ProfileLoader({ humanId }: { humanId: string }) {
  const { data, isLoading, error } = usePersonalContact(humanId);
  if (error)
    return (
      <p role="alert">
        <Trans>
          Couldn't load your profile. Reopen this page to try again.
        </Trans>
      </p>
    );
  if (isLoading || data === undefined)
    return (
      <p role="status">
        <Trans>Loading…</Trans>
      </p>
    );
  return <ProfileForm humanId={humanId} human={data} />;
}

function ProfileForm({
  humanId,
  human,
}: {
  humanId: string;
  human: HumanRecord | null;
}) {
  const { t } = useLingui();
  const auth = useAuth();
  const organizations = useOrganizations();
  const save = useMutation({
    mutationFn: (values: Parameters<typeof savePersonalContact>[1]) =>
      savePersonalContact(humanId, {
        ...values,
        phone: formatProfilePhone(values.phone, navigator.language),
      }),
    // Fork: say so when the profile saves, as Granola's "Profile updated"
    // toast does; one id, so typing refreshes one toast instead of stacking
    // (owner test, Oct 4; NN/g heuristic #1, visibility of system status).
    onSuccess: () => {
      toast.success(t`Profile updated`, { id: "profile-updated" });
    },
  });
  const metadataName = auth.session?.user.user_metadata?.full_name;
  // Fork: the email defaults to the Upshot account, not the upstream auth
  // one (journey-account-settings P3; Granola screen 19).
  const upshotEmail = useUpshotAccount((state) => state.session?.email);
  const form = useForm({
    defaultValues: {
      name:
        human?.name ?? (typeof metadataName === "string" ? metadataName : ""),
      email: human?.email || upshotEmail || auth.session?.user.email || "",
      phone: formatProfilePhone(human?.phone ?? "", navigator.language),
      jobTitle: human?.jobTitle ?? "",
      linkedinUsername: human?.linkedinUsername ?? "",
      memo: human?.memo ?? "",
      organizationId: human?.organizationId ?? "",
    },
    listeners: {
      onChange: ({ formApi }) => save.mutate(formApi.state.values),
    },
    onSubmit: ({ value }) => save.mutate(value),
  });
  const memoId = useId();
  const fields = [
    { name: "name", label: t`Name`, type: "text" },
    { name: "jobTitle", label: t`Job title`, type: "text" },
    { name: "email", label: t`Email`, type: "email" },
    { name: "phone", label: t`Phone`, type: "tel" },
    { name: "linkedinUsername", label: t`LinkedIn`, type: "text" },
  ] as const;

  // Fork: label on the left, field on the right, rows in cards, as
  // Granola's Settings › Profile (granola-compare-oct3 section 8).
  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SettingsGroup title={<Trans>Your info</Trans>}>
        <div>
          <ProfilePhoto
            userId={humanId}
            // Fork: the same name as the Settings sidebar header (saved
            // name, then the Upshot email's local part), never a letter from
            // an internal ID or the app's name. With no name the photo shows
            // a person icon, as the sidebar header does (NN/g #4).
            name={
              human?.name?.trim() || upshotEmail?.split("@")[0]?.trim() || ""
            }
            localPhoto={human?.avatarDataUrl ?? null}
            onSave={(avatarDataUrl) =>
              savePersonalContact(humanId, {
                ...form.state.values,
                phone: formatProfilePhone(
                  form.state.values.phone,
                  navigator.language,
                ),
                avatarDataUrl,
              })
            }
          />
        </div>
        {fields.map(({ name, label, type }) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <ProfileFieldRow label={label}>
                {(id) => (
                  <PrefixedInput
                    prefix={
                      // Fork: LinkedIn takes the username after a muted
                      // linkedin.com/in/ (journey-account-settings P3;
                      // Granola screen 19).
                      name === "linkedinUsername" ? "linkedin.com/in/" : null
                    }
                    inputId={id}
                  >
                    <Input
                      id={id}
                      type={type}
                      aria-describedby={
                        name === "linkedinUsername" ? `${id}-prefix` : undefined
                      }
                      value={field.state.value}
                      // Fork: one field fill with the Settings dropdowns:
                      // the light tint in dark (Apple HIG, Dark Mode;
                      // shadcn/ui input; NN/g #4).
                      className="bg-card dark:bg-input/30 h-8 w-full min-w-0"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={() => {
                        if (name === "phone") {
                          field.handleChange(
                            formatProfilePhone(
                              field.state.value,
                              navigator.language,
                            ),
                          );
                        }
                        field.handleBlur();
                      }}
                      // Fork: no sample number; a placeholder looks like
                      // saved data (NN/g, "Placeholders in Form Fields Are
                      // Harmful").
                    />
                  </PrefixedInput>
                )}
              </ProfileFieldRow>
            )}
          </form.Field>
        ))}
      </SettingsGroup>

      <SettingsGroup title={<Trans>Your company</Trans>}>
        <form.Field name="organizationId">
          {(field) => (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">
                <Trans>Company</Trans>
              </span>
              <div className="flex min-w-0 justify-end">
                <ContactOrganizationSelector
                  // Fork: the row says Company, so the action does too
                  // (NN/g #4).
                  addLabel={<Trans>Add company</Trans>}
                  organization={
                    organizations.find(
                      (organization) => organization.id === field.state.value,
                    ) ?? null
                  }
                  organizations={organizations}
                  onChange={(id) => field.handleChange(id ?? "")}
                />
              </div>
            </div>
          )}
        </form.Field>
        {/* Fork: "About you", with where it lives, until it feeds Enhance
            (journey-account-settings P3; Granola screen 19). */}
        <form.Field name="memo">
          {(field) => (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <label htmlFor={memoId} className="text-sm font-medium">
                  <Trans>About you</Trans>
                </label>
                <p
                  id={`${memoId}-hint`}
                  className="text-muted-foreground text-xs"
                >
                  {/* Fork: "this computer" off a Mac (NN/g heuristic #2,
                      the user's words). */}
                  {isMac() ? (
                    <Trans>Only on this Mac.</Trans>
                  ) : (
                    <Trans>Only on this computer.</Trans>
                  )}
                </p>
              </div>
              <Textarea
                id={memoId}
                aria-describedby={`${memoId}-hint`}
                value={field.state.value}
                // Fork: the same fill as the fields above (NN/g #4).
                className="bg-card dark:bg-input/30"
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                rows={3}
              />
            </div>
          )}
        </form.Field>
      </SettingsGroup>
      {save.isError && (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-destructive text-sm">
            <Trans>Couldn't save your profile. Try again.</Trans>
          </p>
          <Button type="submit" variant="outline">
            <Trans>Retry</Trans>
          </Button>
        </div>
      )}
    </form>
  );
}

function PrefixedInput({
  prefix,
  inputId,
  children,
}: {
  prefix: string | null;
  inputId: string;
  children: ReactNode;
}) {
  if (!prefix) return <>{children}</>;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span
        id={`${inputId}-prefix`}
        className="text-muted-foreground shrink-0 text-sm"
      >
        {prefix}
      </span>
      {children}
    </div>
  );
}

function ProfileFieldRow({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="w-56 max-w-[60%] min-w-0">{children(id)}</div>
    </div>
  );
}
