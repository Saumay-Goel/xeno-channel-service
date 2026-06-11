import { Router } from "express";
import * as sendController from "../controllers/send.controller.js";

const router = Router();

router.post("/", (req, res, next) => {
  Promise.resolve(sendController.send(req, res)).catch(next);
});

export default router;
