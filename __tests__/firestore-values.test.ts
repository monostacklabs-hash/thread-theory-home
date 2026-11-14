/**
 * @jest-environment node
 */

import {
  buildSetWrite,
  decodeFields,
  encodeFields,
  FieldValue,
  Timestamp
} from "@/lib/firebase/firestore";

const NAME = "projects/p/databases/(default)/documents/bookings/TTH-0001";

describe("Firestore value encoding", () => {
  it("round-trips the value types bookings use", () => {
    const data = {
      name: "Asha",
      email: null,
      bookingCount: 12,
      weight: 1.5,
      active: true,
      tags: ["a", "b"],
      nested: { city: "Kochi" }
    };

    expect(decodeFields(encodeFields(data))).toEqual(data);
  });

  it("encodes integers as strings and decodes them back to numbers", () => {
    expect(encodeFields({ bookingCount: 41 })).toEqual({ bookingCount: { integerValue: "41" } });
    expect(decodeFields({ bookingCount: { integerValue: "41" } })).toEqual({ bookingCount: 41 });
  });

  it("decodes timestamps into objects with toDate()", () => {
    const decoded = decodeFields({ createdAt: { timestampValue: "2026-06-01T10:00:00.000Z" } });
    expect(decoded.createdAt).toBeInstanceOf(Timestamp);
    expect(decoded.createdAt.toDate().toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });

  it("skips undefined fields", () => {
    expect(encodeFields({ name: "Asha", notes: undefined })).toEqual({
      name: { stringValue: "Asha" }
    });
  });
});

describe("buildSetWrite", () => {
  it("overwrites the whole document by default", () => {
    const write = buildSetWrite(NAME, { name: "Asha" });
    expect(write).toEqual({ update: { name: NAME, fields: { name: { stringValue: "Asha" } } } });
  });

  it("limits a merge to the fields given", () => {
    const write = buildSetWrite(NAME, { status: "shipped", email: null }, { merge: true });
    expect(write.updateMask).toEqual({ fieldPaths: ["status", "email"] });
  });

  it("turns server timestamps into transforms, not field values", () => {
    const write = buildSetWrite(
      NAME,
      { status: "shipped", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    expect(write.update).toEqual({ name: NAME, fields: { status: { stringValue: "shipped" } } });
    expect(write.updateMask).toEqual({ fieldPaths: ["status"] });
    expect(write.updateTransforms).toEqual([
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
    ]);
  });
});
