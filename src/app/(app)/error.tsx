"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isDb = /MONGODB_URI|ECONNREFUSED|querySrv|MongoServerSelectionError|Authentication failed/i.test(error.message);
  return (
    <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-heading">{isDb ? "Database connection problem" : "Something went wrong"}</h2>
      <p className="mt-2 text-sm text-muted">
        {isDb
          ? "Check MONGODB_URI in your .env.local file, make sure your IP is allowed in MongoDB Atlas, then restart the server."
          : "The page could not be loaded. Try again, and if it keeps happening check the server logs."}
      </p>
      {error.message && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-muted">{error.message}</pre>
      )}
      <button onClick={reset} className="btn btn-primary mt-6">
        <RotateCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
