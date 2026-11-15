import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/admin/login-form";

const signOut = jest.fn().mockResolvedValue(undefined);
const signInWithPopup = jest.fn();
const assignLocation = jest.fn();

jest.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters = jest.fn();
  },
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args)
}));
jest.mock("@/lib/firebase/client", () => ({ getFirebaseAuth: () => ({ signOut }) }));
jest.mock("@/components/admin/navigate", () => ({
  assignLocation: (...args: unknown[]) => assignLocation(...args)
}));

const user = { getIdToken: jest.fn().mockResolvedValue("id-token") };

function respond(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  signInWithPopup.mockResolvedValue({ user });
});

describe("LoginForm", () => {
  it("has a Google button and no password field", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it("trades the Google ID token for a session, then opens the dashboard", async () => {
    respond(200, { ok: true });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(assignLocation).toHaveBeenCalledWith("/admin"));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/session",
      expect.objectContaining({ body: JSON.stringify({ idToken: "id-token" }) })
    );
  });

  it("signs out of Firebase and explains when the account is not allowed", async () => {
    respond(403, { error: "This account is not allowed" });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not allowed to manage bookings");
    expect(signOut).toHaveBeenCalled();
    expect(assignLocation).not.toHaveBeenCalled();
  });

  it("says nothing when the popup is closed", async () => {
    signInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a blocked popup and an unauthorised domain", async () => {
    signInWithPopup.mockRejectedValueOnce({ code: "auth/popup-blocked" });
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("blocked the sign-in window");

    signInWithPopup.mockRejectedValueOnce({ code: "auth/unauthorized-domain" });
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("not set up for Google sign-in"));
  });
});
