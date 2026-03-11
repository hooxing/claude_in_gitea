import { describe, test, expect } from "bun:test";
import { checkWritePermissions } from "../src/gitea/validation/permissions";
import { createMockContext } from "./mockContext";

const createClient = (permission: string, shouldThrow = false) => {
  return {
    get: async () => {
      if (shouldThrow) {
        throw new Error("API error");
      }
      return { permission };
    },
  } as any;
};

describe("checkWritePermissions (Gitea)", () => {
  test("admin 权限允许", async () => {
    const context = createMockContext();
    const result = await checkWritePermissions(createClient("admin"), context);
    expect(result).toBe(true);
  });

  test("write 权限允许", async () => {
    const context = createMockContext();
    const result = await checkWritePermissions(createClient("write"), context);
    expect(result).toBe(true);
  });

  test("owner 权限允许", async () => {
    const context = createMockContext();
    const result = await checkWritePermissions(createClient("owner"), context);
    expect(result).toBe(true);
  });

  test("read 权限拒绝", async () => {
    const context = createMockContext();
    const result = await checkWritePermissions(createClient("read"), context);
    expect(result).toBe(false);
  });

  test("allowed_non_write_users 支持单用户绕过", async () => {
    const context = createMockContext({ actor: "alice" });
    const result = await checkWritePermissions(
      createClient("read"),
      context,
      "alice",
      true,
    );
    expect(result).toBe(true);
  });

  test("allowed_non_write_users 支持通配符绕过", async () => {
    const context = createMockContext({ actor: "bob" });
    const result = await checkWritePermissions(
      createClient("read"),
      context,
      "*",
      true,
    );
    expect(result).toBe(true);
  });

  test("未提供 token 时不允许绕过", async () => {
    const context = createMockContext({ actor: "alice" });
    const result = await checkWritePermissions(
      createClient("read"),
      context,
      "alice",
      false,
    );
    expect(result).toBe(false);
  });

  test("API 异常会抛出错误", async () => {
    const context = createMockContext({ actor: "alice" });
    await expect(
      checkWritePermissions(createClient("read", true), context),
    ).rejects.toThrow("Failed to check permissions");
  });
});

