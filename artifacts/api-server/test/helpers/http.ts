import supertest from "supertest";
import app from "../../src/app";

// A supertest client bound to the Express app instance. No network port is
// opened — supertest drives the app in-process.
export const api = supertest(app);
