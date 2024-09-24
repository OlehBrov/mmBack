// const { sqlPool } = require("../config/connectSQL");
const jwt = require("jsonwebtoken");
// const Manager = require("../models/manager");
const { httpError } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");

const { AUTH_TOKEN_SECRET_KEY } = process.env;

const adminAuthenticate = async (req, res, next) => {
  const { authorization = "" } = req.headers;

  const [bearer, token] = authorization.split(" ");
  console.log("adminAuthenticate token", token);
  if (bearer !== "Bearer" && !token) {
    next(httpError(401, "Not authorized"));
  }
  try {
    const { manager_id } = jwt.verify(token, AUTH_TOKEN_SECRET_KEY);

    // const store = await Store.findById(id);
    // const result =
    //   await sqlPool.query`SELECT manager_id, token FROM Managers WHERE manager_id = ${manager_id}`;

    const prismaManager = await prisma.managers.findUnique({
      where: {
        manager_id: manager_id,
      },
    });

    if (!prismaManager || !prismaManager.token) {
      next(httpError(401, "Not authorized"));
    }
    console.log("prismaManager", prismaManager);
    req.manager = prismaManager;
    next();
  } catch (error) {
    console.error("Error:", error.message);
    next(httpError(401, "Not authorized"));
  }
};

module.exports = adminAuthenticate;
