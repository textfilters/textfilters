#!/usr/bin/env node

import { rm } from "node:fs/promises";
import path from "node:path";

// Workspace builds own only their generated output directory.
await rm(path.resolve("dist"), { recursive: true, force: true });
