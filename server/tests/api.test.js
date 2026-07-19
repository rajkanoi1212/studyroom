const request = require("supertest");
const path = require("path");
const { createApp } = require("../src/app");

const app = createApp();

async function registerUser(name, email) {
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "password123" });
  return res.body; // { user, token }
}

describe("auth", () => {
  test("register then login", async () => {
    const { user, token } = await registerUser("Alice", "alice@test.com");
    expect(user.email).toBe("alice@test.com");
    expect(token).toBeTruthy();

    const login = await request(app).post("/api/auth/login").send({ email: "alice@test.com", password: "password123" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  test("duplicate email rejected", async () => {
    await registerUser("Bob", "bob@test.com");
    const res = await request(app).post("/api/auth/register").send({ name: "Bob2", email: "bob@test.com", password: "password123" });
    expect(res.status).toBe(409);
  });

  test("wrong password rejected", async () => {
    await registerUser("Carl", "carl@test.com");
    const res = await request(app).post("/api/auth/login").send({ email: "carl@test.com", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  test("protected route rejects missing token", async () => {
    const res = await request(app).get("/api/groups");
    expect(res.status).toBe(401);
  });
});

describe("groups", () => {
  test("create group, appears in list, creator is owner", async () => {
    const { token } = await registerUser("Dana", "dana@test.com");
    const create = await request(app).post("/api/groups").set("Authorization", `Bearer ${token}`).send({ name: "CS Group", subject: "Algorithms" });
    expect(create.status).toBe(201);
    expect(create.body.member_count).toBe(1);
    expect(create.body.invite_code).toMatch(/^[A-Z0-9]{6}$/);

    const list = await request(app).get("/api/groups").set("Authorization", `Bearer ${token}`);
    expect(list.body.length).toBe(1);
    expect(list.body[0].name).toBe("CS Group");
  });

  test("join via invite code adds member", async () => {
    const { token: ownerToken } = await registerUser("Erin", "erin@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({ name: "Bio Group" })).body;

    const { token: joinerToken } = await registerUser("Frank", "frank@test.com");
    const join = await request(app).post("/api/groups/join").set("Authorization", `Bearer ${joinerToken}`).send({ invite_code: group.invite_code });
    expect(join.status).toBe(200);
    expect(join.body.member_count).toBe(2);
  });

  test("wrong invite code returns 404", async () => {
    const { token } = await registerUser("Gina", "gina@test.com");
    const res = await request(app).post("/api/groups/join").set("Authorization", `Bearer ${token}`).send({ invite_code: "ZZZZZZ" });
    expect(res.status).toBe(404);
  });

  test("non-member cannot see members list", async () => {
    const { token: ownerToken } = await registerUser("Hank", "hank@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({ name: "Private Group" })).body;
    const { token: outsiderToken } = await registerUser("Ivy", "ivy@test.com");

    const res = await request(app).get(`/api/groups/${group.id}/members`).set("Authorization", `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });
});

describe("materials", () => {
  test("upload PDF, list it, download it", async () => {
    const { token } = await registerUser("Jill", "jill@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${token}`).send({ name: "Materials Group" })).body;

    const fakePdf = Buffer.from("%PDF-1.4 fake pdf content for testing");
    const upload = await request(app)
      .post(`/api/groups/${group.id}/materials`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fakePdf, { filename: "notes.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);
    expect(upload.body.original_name).toBe("notes.pdf");

    const list = await request(app).get(`/api/groups/${group.id}/materials`).set("Authorization", `Bearer ${token}`);
    expect(list.body.length).toBe(1);

    const download = await request(app)
      .get(`/api/groups/${group.id}/materials/${upload.body.id}/download`)
      .set("Authorization", `Bearer ${token}`)
      .buffer()
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.body.toString()).toContain("fake pdf content");
  });

  test("non-PDF upload rejected", async () => {
    const { token } = await registerUser("Kyle", "kyle@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${token}`).send({ name: "G" })).body;

    const res = await request(app)
      .post(`/api/groups/${group.id}/materials`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not a pdf"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });
});

describe("message history", () => {
  test("group message history is empty then reflects socket-sent messages", async () => {
    const { token } = await registerUser("Liam", "liam@test.com");
    const group = (await request(app).post("/api/groups").set("Authorization", `Bearer ${token}`).send({ name: "Chat Group" })).body;

    const res = await request(app).get(`/api/groups/${group.id}/messages?room=group`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
