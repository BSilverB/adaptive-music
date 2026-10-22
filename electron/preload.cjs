const { contextBridge } = require("electron");

const backendPort = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 8000;

contextBridge.exposeInMainWorld("__BACKEND_PORT__", backendPort);
