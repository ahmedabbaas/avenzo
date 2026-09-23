import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return json({ error: "Authentication required." }, 401);
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const confirmation = String(payload?.confirmation || "")
      .trim()
      .toLowerCase();

    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authorization },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Authentication required." }, 401);
    }

    const admin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    async function listUserMedia(path: string): Promise<string[]> {
      const files: string[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await admin.storage
          .from("media")
          .list(path, {
            limit: pageSize,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

        if (error) throw error;

        const page = data || [];

        for (const item of page) {
          const itemPath = path ? path + "/" + item.name : item.name;

          if (item.id) {
            files.push(itemPath);
          } else {
            files.push(...(await listUserMedia(itemPath)));
          }
        }

        if (page.length < pageSize) break;
        offset += pageSize;
      }

      return files;
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: "Account profile could not be verified." }, 409);
    }

    if (confirmation !== String(profile.username).toLowerCase()) {
      return json({ error: "Username confirmation does not match." }, 400);
    }

    const mediaFiles = await listUserMedia(user.id);

    for (let index = 0; index < mediaFiles.length; index += 100) {
      const chunk = mediaFiles.slice(index, index + 100);
      if (!chunk.length) continue;

      const { error } = await admin.storage.from("media").remove(chunk);
      if (error) throw error;
    }

    const { error: deleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch {
    return json(
      { error: "Account could not be deleted right now." },
      500
    );
  }
});
