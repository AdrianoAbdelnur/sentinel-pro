import { describe, expect, it } from "vitest";
import { createHowenFleetCompanyResolver, resolveHowenFleetCompany } from "./fleet";

describe("resolveHowenFleetCompany", () => {
  it("inherits the nearest parent company", () => {
    expect(resolveHowenFleetCompany([{ guid: "child", parentid: "parent", contacts: "" }, { guid: "parent", contacts: "Acme" }], "child")).toEqual({ directFleetId: "child", companySourceFleetId: "parent", company: "Acme", outcome: "ancestor" });
  });

  it("stops on missing parents and cycles without inventing a company", () => {
    expect(resolveHowenFleetCompany([{ guid: "a", parentid: "b" }, { guid: "b", parentid: "a" }], "a")).toEqual({ directFleetId: "a", outcome: "unresolved" });
    expect(resolveHowenFleetCompany([{ guid: "a", parentid: "missing" }], "a")).toEqual({ directFleetId: "a", outcome: "unresolved" });
  });

  it("builds one reusable resolver for every vehicle in an import", () => {
    const resolve = createHowenFleetCompanyResolver([
      { guid: "root", contacts: "Acme" },
      { guid: "child-a", parentid: "root" },
      { guid: "child-b", parentid: "root" },
    ]);

    expect(resolve("child-a")).toMatchObject({ company: "Acme", companySourceFleetId: "root" });
    expect(resolve("child-b")).toMatchObject({ company: "Acme", companySourceFleetId: "root" });
  });
});
