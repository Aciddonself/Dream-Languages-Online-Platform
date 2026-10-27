import assert from "node:assert/strict";
import test from "node:test";
import { createTextPdf, readDlaLogoJpeg } from "../src/lib/pdf";

test("stamped student PDF embeds the DLA logo and signer details", async () => {
  const logo = await readDlaLogoJpeg();
  const pdf = createTextPdf("Student identity card", ["Registration number: DLA/2026/ENG/0001"], logo, {
    stamperName: "DLA Administrator",
    stamperTitle: "School Administrator",
    date: "27 October 2026",
    logoJpeg: logo,
  });
  const contents = Buffer.from(pdf).toString("latin1");
  assert.ok(contents.startsWith("%PDF-1.4"));
  assert.match(contents, /OFFICIAL DLA DIGITAL STAMP/);
  assert.match(contents, /DLA Administrator/);
  assert.match(contents, /School Administrator/);
  assert.match(contents, /27 October 2026/);
  assert.match(contents, /\/DlaLogo \d+ 0 R/);
  assert.equal((contents.match(/\/Subtype \/Image/g) ?? []).length, 2);

  const startXref = Number(contents.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(contents.slice(startXref, startXref + 4), "xref");
});

test("regular PDFs do not include an official staff stamp", () => {
  const pdf = createTextPdf("Payment receipt", ["Paid in full"]);
  const contents = Buffer.from(pdf).toString("latin1");
  assert.ok(contents.startsWith("%PDF-1.4"));
  assert.doesNotMatch(contents, /OFFICIAL DLA DIGITAL STAMP/);
  assert.doesNotMatch(contents, /\/DlaLogo/);
});
