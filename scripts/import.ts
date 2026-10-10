/**
 * Import menus without running the web server:
 *   pnpm import:menus              → ETH + UZH(stub) for the current week
 *   pnpm import:menus eth 2026-10-12
 */
import { runImport, type ImportSource } from "../src/lib/importers";

const source = (process.argv[2] ?? "all") as ImportSource;
const week = process.argv[3];

runImport(source, week)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
