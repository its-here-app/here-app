require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

const USER_ID = "d32b513c-e6a7-4e4a-b9de-e1c895e9a048";
const QUALITY = 90;

async function convertToJpeg(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf).flatten({ background: "#ffffff" }).jpeg({ quality: QUALITY }).toBuffer();
}

// Replace the file's extension with .jpg, preserving the rest of the path.
function jpgPath(path) {
  return path.replace(/\.[a-z0-9]+$/i, ".jpg");
}

async function uploadJpeg(bucket, path, buf) {
  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function storagePathFromPublicUrl(bucket, url) {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) throw new Error(`unexpected URL shape: ${url}`);
  return decodeURIComponent(url.slice(i + marker.length));
}

async function convertAvatar() {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", USER_ID)
    .single();
  if (error) throw error;
  if (!profile.avatar_url) {
    console.log("no avatar_url set, skipping");
    return;
  }
  if (profile.avatar_url.endsWith(".jpg") || profile.avatar_url.endsWith(".jpeg")) {
    console.log("avatar already jpeg, skipping:", profile.avatar_url);
    return;
  }
  console.log("converting avatar:", profile.avatar_url);
  const path = storagePathFromPublicUrl("profile-photos", profile.avatar_url);
  const jpegBuf = await convertToJpeg(profile.avatar_url);
  const newPath = jpgPath(path);
  const newUrl = await uploadJpeg("profile-photos", newPath, jpegBuf);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ avatar_url: newUrl })
    .eq("id", USER_ID);
  if (updateErr) throw updateErr;
  console.log("  -> avatar_url updated to", newUrl);
}

async function convertPlaylistCovers() {
  const { data: playlists, error } = await supabase
    .from("playlists")
    .select("id, name, cover_photo_url")
    .eq("user_id", USER_ID);
  if (error) throw error;

  for (const playlist of playlists) {
    const fullUrl = playlist.cover_photo_url;
    if (!fullUrl) {
      console.log(`[${playlist.name}] no cover_photo_url, skipping`);
      continue;
    }
    if (!/\/playlist-covers\//.test(fullUrl)) {
      console.log(`[${playlist.name}] using a default (non-uploaded) cover, skipping:`, fullUrl);
      continue;
    }
    if (fullUrl.endsWith(".jpg") || fullUrl.endsWith(".jpeg")) {
      console.log(`[${playlist.name}] cover already jpeg, skipping:`, fullUrl);
      continue;
    }

    console.log(`[${playlist.name}] converting cover:`, fullUrl);
    const fullPath = storagePathFromPublicUrl("playlist-covers", fullUrl);
    const thumbUrl = fullUrl.replace(/-full\.([a-z0-9]+)(\?.*)?$/i, "-thumb.$1$2");
    const thumbPath = storagePathFromPublicUrl("playlist-covers", thumbUrl);

    const [fullJpeg, thumbJpeg] = await Promise.all([
      convertToJpeg(fullUrl),
      convertToJpeg(thumbUrl).catch((err) => {
        console.log(`  no sibling thumb found (${err.message}), skipping thumb`);
        return null;
      }),
    ]);

    const newFullUrl = await uploadJpeg("playlist-covers", jpgPath(fullPath), fullJpeg);
    if (thumbJpeg) {
      await uploadJpeg("playlist-covers", jpgPath(thumbPath), thumbJpeg);
    }

    const { error: updateErr } = await supabase
      .from("playlists")
      .update({ cover_photo_url: newFullUrl })
      .eq("id", playlist.id);
    if (updateErr) throw updateErr;
    console.log("  -> cover_photo_url updated to", newFullUrl);
  }
}

(async () => {
  await convertAvatar();
  await convertPlaylistCovers();
  console.log("done");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
