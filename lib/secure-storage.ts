import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;

type ChunkManifest = {
  version: 1;
  chunks: number;
};

function getManifestKey(key: string) {
  return `${key}:manifest`;
}

function getChunkKey(key: string, index: number) {
  return `${key}:chunk:${index}`;
}

async function readManifest(key: string) {
  const value = await SecureStore.getItemAsync(getManifestKey(key));

  if (!value) {
    return null;
  }

  try {
    const manifest = JSON.parse(value) as ChunkManifest;

    if (manifest.version === 1 && Number.isInteger(manifest.chunks)) {
      return manifest;
    }
  } catch {
    await SecureStore.deleteItemAsync(getManifestKey(key));
  }

  return null;
}

async function removeChunks(key: string, chunks: number) {
  await Promise.all(
    Array.from({ length: chunks }, (_, index) =>
      SecureStore.deleteItemAsync(getChunkKey(key, index))
    )
  );
}

export const secureStorageAdapter = {
  async getItem(key: string) {
    const manifest = await readManifest(key);

    if (!manifest) {
      return SecureStore.getItemAsync(key);
    }

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        SecureStore.getItemAsync(getChunkKey(key, index))
      )
    );

    if (chunks.some((chunk) => chunk === null)) {
      return null;
    }

    return chunks.join("");
  },

  async setItem(key: string, value: string) {
    const previousManifest = await readManifest(key);

    if (previousManifest) {
      await removeChunks(key, previousManifest.chunks);
    }

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(getManifestKey(key));
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(getChunkKey(key, index), chunk)
      )
    );

    await SecureStore.setItemAsync(
      getManifestKey(key),
      JSON.stringify({ version: 1, chunks: chunks.length } satisfies ChunkManifest)
    );
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(key: string) {
    const manifest = await readManifest(key);

    if (manifest) {
      await removeChunks(key, manifest.chunks);
    }

    await SecureStore.deleteItemAsync(getManifestKey(key));
    await SecureStore.deleteItemAsync(key);
  }
};
