/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaController } from "../../src/controllers/MediaController";
import { Env } from "../../src/types";

describe("MediaController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      params: { key: "test-image.png" },
      body: "fake-image-data",
    };
    mockEnv = {
      MEDIA_BUCKET: {
        put: vi.fn().mockResolvedValue({ key: "test-image.png" }),
        get: vi.fn().mockResolvedValue({
          body: "fake-image-data",
          writeHttpMetadata: vi.fn(),
          httpEtag: "etag-123",
        }),
      },
    } as unknown as Env;
  });

  describe("upload", () => {
    it("should upload file", async () => {
      const response = await MediaController.upload(mockRequest, mockEnv);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.key).toBe("test-image.png");
      expect(mockEnv.MEDIA_BUCKET.put).toHaveBeenCalledWith(
        "test-image.png",
        "fake-image-data",
      );
    });

    it("should return 503 if bucket not configured", async () => {
      mockEnv.MEDIA_BUCKET = undefined as any;
      const response = await MediaController.upload(mockRequest, mockEnv);
      expect(response.status).toBe(503);
    });
  });

  describe("download", () => {
    it("should download file", async () => {
      const response = await MediaController.download(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("fake-image-data");
      expect(response.headers.get("etag")).toBe("etag-123");
    });

    it("should return 404 if file not found", async () => {
      (mockEnv.MEDIA_BUCKET.get as any).mockResolvedValue(null);
      const response = await MediaController.download(mockRequest, mockEnv);
      expect(response.status).toBe(404);
    });

    it("should return 503 if bucket not configured", async () => {
      mockEnv.MEDIA_BUCKET = undefined as any;
      const response = await MediaController.download(mockRequest, mockEnv);
      expect(response.status).toBe(503);
    });
  });
});
