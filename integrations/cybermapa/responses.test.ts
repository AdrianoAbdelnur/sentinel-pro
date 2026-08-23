import { describe, expect, it } from "vitest";

import { parseCybermapaCurrentDataResponse, parseCybermapaVehiclesResponse } from "./responses";

describe("parseCybermapaVehiclesResponse", () => {
  it("keeps only the observed GETVEHICULOS fields from a valid response", () => {
    const records = parseCybermapaVehiclesResponse([
      {
        id: 501,
        gps_id: 90001,
        gps_identificador: "GPS-90001",
        alias: "Camion 1",
        anio: 2019,
        color: "blanco",
        consumo: 12.5,
        descripcion: "Camion de reparto",
        marca: "Ford",
        modelo: "Cargo",
        nombre: "Camion Norte",
        nombre_empresa: "Transporte Andino",
        nombre_modulo: "modulo-1",
        patente: "AB123CD",
        clave: "should-not-cross-the-boundary",
        token: "should-not-cross-the-boundary",
      },
    ]);

    expect(records).toEqual([
      {
        id: 501,
        gps_id: 90001,
        gps_identificador: "GPS-90001",
        alias: "Camion 1",
        anio: 2019,
        color: "blanco",
        consumo: 12.5,
        descripcion: "Camion de reparto",
        marca: "Ford",
        modelo: "Cargo",
        nombre: "Camion Norte",
        nombre_empresa: "Transporte Andino",
        nombre_modulo: "modulo-1",
        patente: "AB123CD",
      },
    ]);
  });

  it.each([null, {}, { data: [] }, "not-an-array"])(
    "rejects a non-array envelope: %j",
    (value) => {
      expect(() => parseCybermapaVehiclesResponse(value)).toThrow(
        "Invalid Cybermapa vehicles response",
      );
    },
  );

  it("isolates non-object records and malformed optional fields", () => {
    const records = parseCybermapaVehiclesResponse([
      null,
      "not-an-object",
      {
        gps_id: 90002,
        nombre_empresa: "Transporte Sur",
        consumo: {},
      },
    ]);

    expect(records).toEqual([{ gps_id: 90002, nombre_empresa: "Transporte Sur" }]);
  });

  it("never treats the documented but stale id_gps field as a substitute for the live gps_id identity", () => {
    const records = parseCybermapaVehiclesResponse([
      {
        id_gps: 90003,
        nombre_empresa: "Transporte Oeste",
        patente: "AC999ZZ",
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).not.toHaveProperty("gps_id");
    expect(records[0]).not.toHaveProperty("id_gps");
    expect(records[0]).toEqual({ nombre_empresa: "Transporte Oeste", patente: "AC999ZZ" });
  });

  it("accepts a genuinely empty vehicle list as a valid result, distinct from a rejected malformed envelope", () => {
    expect(parseCybermapaVehiclesResponse([])).toEqual([]);
  });
});

describe("parseCybermapaCurrentDataResponse", () => {
  it("parses the documented current GPS response and preserves provider strings", () => {
    expect(parseCybermapaCurrentDataResponse([
      {
        nombre: "prueba01",
        alias: "movil 1",
        patente: "AFV 132",
        gps: "123456789101177",
        latitud: "-34.55568800",
        longitud: "-58.46693600",
        fecha: "21/09/2016 11:48:32",
        sentido: "217",
        velocidad: "0",
        evento: "8",
      },
    ])).toEqual([{
      nombre: "prueba01",
      alias: "movil 1",
      patente: "AFV 132",
      gps: "123456789101177",
      latitud: "-34.55568800",
      longitud: "-58.46693600",
      fecha: "21/09/2016 11:48:32",
      sentido: "217",
      velocidad: "0",
      evento: "8",
    }]);
  });

  it("accepts the documented uppercase output format", () => {
    expect(parseCybermapaCurrentDataResponse([{
      GPS: "123",
      LATITUD: "-34.6",
      LONGITUD: "-58.4",
      FECHA_COMUNICACION: "08/25/16 10:14:23",
      VELOCIDAD: "12",
    }])).toEqual([{
      gps: "123",
      latitud: "-34.6",
      longitud: "-58.4",
      fecha: "08/25/16 10:14:23",
      velocidad: "12",
    }]);
  });

  it.each([null, {}, { data: [] }, "not-an-array"])(
    "rejects a non-array envelope: %j",
    (value) => {
      expect(() => parseCybermapaCurrentDataResponse(value)).toThrow(
        "Invalid Cybermapa current data response",
      );
    },
  );
});
