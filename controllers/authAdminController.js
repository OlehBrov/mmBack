const { json } = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { AUTH_TOKEN_SECRET_KEY } = process.env;
const { ctrlWrapper } = require("../helpers");
const { prisma } = require("../config/db/dbConfig");
const { token } = require("morgan");

const registerAdmin = async (req, res, next) => {
  const { login, password } = req.body;
  try {
    const isExist = await prisma.managers.findUnique({
      where: {
        login: login,
      },
    });
    if (isExist) {
      return res.status(409).json({
        status: "error",
        code: 409,
        message: "Login is already in use",
        data: "Conflict",
      });
    }
  } catch (error) {
    next(error);
  }

  const hashPassword = await bcrypt.hash(password, 10);

  try {
    const manager = await prisma.managers.create({
      data: {
        login,
        password: hashPassword,
      },
    });
    const { manager_id } = manager;
    const payload = { manager_id: manager_id };
    const newToken = jwt.sign(payload, AUTH_TOKEN_SECRET_KEY, { expiresIn: "23h" });
    // await Manager.findByIdAndUpdate(id, { token });
    const upd = await prisma.managers.update({
      where: {
        manager_id: manager_id,
      },
      data: {
        token: newToken,
      },
    });

    res.status(201).json({
      status: "success",
      code: 201,
      data: {
        message: "Registration successful",
        login: upd.login,
        token: upd.token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logInAdmin = async (req, res, next) => {
  const { login, password } = req.body;
  console.log('login', login)
  console.log('password', password)
  const manager = await prisma.managers.findUnique({
    where: {
      login: login,
    },
  });
  if (!manager) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "User not found",
    });
  }

  const checkPassword = await bcrypt.compare(password, manager.password);

  if (!checkPassword) {
     return next(httpError(401));
  }
  const token = jwt.sign({ manager_id: manager.manager_id }, AUTH_TOKEN_SECRET_KEY, {
    expiresIn: "23h",
  });

  const upd = await prisma.managers.update({
    where: {
      manager_id: manager.manager_id,
    },
    data: {
      token: token,
    },
  });

  res.status(200).json({
    manager_id: upd.manager_id,
    token: upd.token,
  });
};

const logoutAdmin = async (req, res, next) => {
  const { manager_id } = req.manager;

  try {
    await prisma.managers.update({
      where: {
        manager_id: manager_id,
      },
      data: {
        token: null,
      },
    });

    res.status(200).json({
      message: "Logout success",
    });
  } catch {
    return next(httpError(401));
  }
};

module.exports = {
  logInAdmin: ctrlWrapper(logInAdmin),
  registerAdmin: ctrlWrapper(registerAdmin),
  logoutAdmin: ctrlWrapper(logoutAdmin),
};
