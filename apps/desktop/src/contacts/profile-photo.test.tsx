import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signedIn: true,
  getUser: vi.fn(),
  save: vi.fn(),
  mirror: vi.fn(),
}));
vi.mock("~/auth", () => ({
  useAuth: () => ({
    session: mocks.signedIn ? { user: { id: "account-1" } } : null,
    supabase: { auth: { getUser: mocks.getUser } },
  }),
}));
vi.mock("@anlg/supabase/profile-avatar", () => ({
  saveProfileAvatar: mocks.save,
}));
vi.mock("./queries", () => ({
  usePersonalContact: () => ({
    data: { avatarDataUrl: "data:image/jpeg;base64,bGVnYWN5" },
  }),
  updateContactAvatar: mocks.mirror,
}));
vi.mock("./contact-avatar", () => ({
  ContactImage: ({ src }: { src: string }) => <img src={src} alt="Profile" />,
  AvatarUploadButton: ({
    children,
    onUpload,
  }: {
    children: React.ReactNode;
    onUpload: (value: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onUpload("data:image/jpeg;base64,bmV3")}
    >
      {children}Change photo
    </button>
  ),
}));
import { ProfilePhoto } from "./profile-photo";

function view(
  localPhoto: string | null = "data:image/jpeg;base64,bGVnYWN5",
  cachedPhoto?: string,
  name = "Ada",
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (cachedPhoto !== undefined)
    queryClient.setQueryData(["profile-photo", "account-1"], {
      id: "account-1",
      user_metadata: cachedPhoto
        ? { profile_avatar: { url: cachedPhoto } }
        : {},
    });
  const onSave = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ProfilePhoto
        userId="account-1"
        name={name}
        localPhoto={localPhoto}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, onSave };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signedIn = true;
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "account-1", user_metadata: {} } },
    error: null,
  });
  mocks.save.mockResolvedValue({
    id: "account-1",
    user_metadata: {
      profile_avatar: { url: "https://storage.example/new.jpg" },
    },
  });
  mocks.mirror.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("migrates a legacy local photo after checking the authoritative account", async () => {
  const { onSave } = view();
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
  expect(mocks.save).toHaveBeenCalledWith(
    expect.anything(),
    "account-1",
    "data:image/jpeg;base64,bGVnYWN5",
  );
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith("https://storage.example/new.jpg"),
  );
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "https://storage.example/new.jpg",
  );
});

it("uses a newer remote photo without uploading stale local data and mirrors remote removal", async () => {
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: "account-1",
        user_metadata: {
          profile_avatar: { url: "https://storage.example/remote.jpg" },
        },
      },
    },
    error: null,
  });
  const { queryClient } = view();
  await waitFor(() =>
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "https://storage.example/remote.jpg",
    ),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(mocks.mirror).toHaveBeenCalledWith(
      "human",
      "account-1",
      "https://storage.example/remote.jpg",
    ),
  );
  queryClient.setQueryData(["profile-photo", "account-1"], {
    id: "account-1",
    user_metadata: {
      profile_avatar: { url: null },
      avatar_url: "https://provider.example/old.jpg",
    },
  });
  await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
  await waitFor(() =>
    expect(mocks.mirror).toHaveBeenCalledWith("human", "account-1", null),
  );
});

// Fork: one avatar for one person: without a photo, the gray circle with the
// initial that the Settings sidebar header shows (NN/g #4).
it("shows the initial in a gray circle when there is no photo", () => {
  mocks.signedIn = false;
  view(null);
  expect(screen.queryByRole("img")).toBeNull();
  const initial = screen.getByText("A");
  expect(initial.getAttribute("aria-hidden")).toBe("true");
  expect(initial.className).toContain("bg-sidebar-accent");
  expect(initial.className).toContain("rounded-pill");
  expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
});

// Fork: with no name, the same gray circle holds a person icon, never "U"
// (NN/g #4; the Settings sidebar header does the same).
it("shows a person icon in the gray circle when there is no name", () => {
  mocks.signedIn = false;
  const { container } = view(null, undefined, "  ");
  expect(screen.queryByText("U")).toBeNull();
  const circle = container.querySelector("span[aria-hidden]");
  expect(circle?.textContent).toBe("");
  expect(circle?.querySelector("svg")).not.toBeNull();
  expect(circle?.className).toContain("bg-sidebar-accent");
  expect(circle?.className).toContain("rounded-pill");
  expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
});

it("keeps a failed upload available to retry", async () => {
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  view(null);
  fireEvent.click(screen.getByRole("button", { name: /Change photo/ }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "data:image/jpeg;base64,bmV3",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.save).toHaveBeenNthCalledWith(
    2,
    expect.anything(),
    "account-1",
    "data:image/jpeg;base64,bmV3",
  );
});

it("keeps guest photo changes local even with a cached signed-in profile", async () => {
  mocks.signedIn = false;
  const { onSave } = view(null, "https://storage.example/cached.jpg");
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Change photo/ }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith("data:image/jpeg;base64,bmV3"),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.mirror).not.toHaveBeenCalled();
});

it("waits for a fresh profile before migrating a cached legacy photo", async () => {
  let finish!: (value: unknown) => void;
  mocks.getUser.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  view("data:image/jpeg;base64,bGVnYWN5", "");
  await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
  expect(mocks.save).not.toHaveBeenCalled();
  finish({
    data: {
      user: {
        id: "account-1",
        user_metadata: {
          profile_avatar: { url: "https://storage.example/newer.jpg" },
        },
      },
    },
    error: null,
  });
  await waitFor(() =>
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "https://storage.example/newer.jpg",
    ),
  );
  expect(mocks.save).not.toHaveBeenCalled();
});

it("does not migrate cached legacy data after a failed refetch", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("offline"),
  });
  view("data:image/jpeg;base64,bGVnYWN5", "");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(mocks.save).not.toHaveBeenCalled();
});
