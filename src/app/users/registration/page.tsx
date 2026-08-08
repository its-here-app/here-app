"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUser, getUserByUsername } from "@/lib/services/users";
import {
  hasConsecutivePeriods,
  hasEdgePeriod,
  isValidUsername,
  sanitizeUsernameInput,
} from "@/lib/isValidUsername";

type UsernameStatus =
  | "idle"
  | "too-short"
  | "edge-period"
  | "consecutive-periods"
  | "checking"
  | "valid"
  | "taken";

export default function NewUserPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUserName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus("idle");
      return;
    }
    if (username.length < 3) {
      const timer = setTimeout(() => setUsernameStatus("too-short"), 800);
      return () => clearTimeout(timer);
    }
    if (!isValidUsername(username)) {
      const status = hasEdgePeriod(username) ? "edge-period" : "consecutive-periods";
      const timer = setTimeout(() => setUsernameStatus(status), 800);
      return () => clearTimeout(timer);
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const existing = await getUserByUsername(username);
      setUsernameStatus(existing ? "taken" : "valid");
    }, 800);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await createUser({ name, username });
      alert("User created successfully!");
      setName("");
      setUserName("");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const saveDisabled =
    loading ||
    usernameStatus === "too-short" ||
    usernameStatus === "edge-period" ||
    usernameStatus === "consecutive-periods" ||
    usernameStatus === "taken" ||
    usernameStatus === "checking";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">Create New User</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter name"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUserName(sanitizeUsernameInput(e.target.value))}
              required
              minLength={3}
              maxLength={30}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter username"
            />
            {usernameStatus === "too-short" && (
              <p className="text-xs text-red-500 mt-1">Username must be at least 3 characters</p>
            )}
            {usernameStatus === "edge-period" && (
              <p className="text-xs text-red-500 mt-1">
                Username can&apos;t start or end with a period
              </p>
            )}
            {usernameStatus === "consecutive-periods" && (
              <p className="text-xs text-red-500 mt-1">
                Username can&apos;t contain consecutive periods
              </p>
            )}
            {usernameStatus === "taken" && (
              <p className="text-xs text-red-500 mt-1">Username already taken, please try another</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saveDisabled}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </main>
  );
}
