"use client";

import { useActionState } from "react";
import { createAdminAction } from "./actions";

const initialState: { error: string; success: boolean } = { error: "", success: false };

export default function CreateAdminForm() {
  const [state, action, pending] = useActionState(createAdminAction, initialState);

  if (state?.success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        Admin account created successfully.{" "}
        <button onClick={() => window.location.reload()} className="underline">
          Refresh to add another
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {state?.error && (
        <div className="sm:col-span-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Field id="name" name="name" label="Full name" type="text" placeholder="Prof. Example" disabled={pending} />
      <Field id="email" name="email" label="Email" type="email" placeholder="admin@example.com" disabled={pending} />
      <Field id="password" name="password" label="Password" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" disabled={pending} />

      <div className="space-y-1.5">
        <label htmlFor="role" className="block text-sm font-medium text-foreground">
          Role
        </label>
        <select
          id="role"
          name="role"
          disabled={pending}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Creating…" : "Create Admin"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id, name, label, type, placeholder, disabled,
}: {
  id: string; name: string; label: string; type: string; placeholder: string; disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  );
}
