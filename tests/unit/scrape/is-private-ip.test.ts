import { describe, expect, it } from "vitest";
import { isPrivateIp } from "@/lib/scrape/is-private-ip";

describe("isPrivateIp", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.0.0.5", true],
    ["192.168.1.1", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["169.254.169.254", true], // cloud metadata endpoint
    ["::1", true],
    ["fe80::1", true],
    ["fc00::1", true],
    ["8.8.8.8", false],
    ["93.184.216.34", false],
    ["172.32.0.1", false], // just outside the 172.16/12 range
  ])("treats %s as private=%s", (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });
});
