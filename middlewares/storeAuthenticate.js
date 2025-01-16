const jwt = require("jsonwebtoken");
// const { sqlPool } = require("../config/connectSQL");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

// const Store = require("../models/store");

const { AUTH_TOKEN_SECRET_KEY } = process.env;

const storeAuthenticate = async (req, res, next) => {
  console.log("storeAuthenticate invoke");
  const { authorization = "" } = req.headers;

  const [bearer, token] = authorization.split(" ");
  console.log("storeAuthenticate token", token);
  if (bearer !== "Bearer" && !token) {
    next(httpError(401, "Not authorized"));
  }
  try {
    const { auth_id } = jwt.verify(token, AUTH_TOKEN_SECRET_KEY);
    console.log("auth_id", auth_id);
    const prismaStore = await prisma.Store.findUnique({
      where: {
        auth_id: auth_id,
      },
    });

    if (!prismaStore || !prismaStore.token) {
      next(httpError(401, "Not authorized"));
    }

    req.store = prismaStore;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    next(httpError(401, "Not authorized"));
  }
};

module.exports = storeAuthenticate;
