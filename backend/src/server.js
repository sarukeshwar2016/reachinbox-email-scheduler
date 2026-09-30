"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const startServer = () => {
    app_1.default.listen(env_1.env.PORT, () => {
        console.log(`Server started in ${env_1.env.NODE_ENV} mode on port ${env_1.env.PORT}`);
    });
};
startServer();
//# sourceMappingURL=server.js.map