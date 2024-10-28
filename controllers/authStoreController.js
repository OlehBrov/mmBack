const { json } = require("express");
const jwt = require("jsonwebtoken");
const { AUTH_TOKEN_SECRET_KEY, REFRESH_TOKEN_SECRET_KEY } = process.env;
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db/dbConfig");
const { ctrlWrapper } = require("../helpers");

const { httpError } = require("../helpers/");


const refreshToken = async (req, res, next) => {
  console.log('refreshToken invoke', req.body)
  
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return httpError(401);
  }

  const { auth_id } = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET_KEY);
  console.log('refreshToken auth_id', auth_id)
  const prismaStore = await prisma.Store.findUnique({
    where: {
      auth_id: auth_id,
    },
  });
  console.log('prismaStore', prismaStore)
  if (!prismaStore) {
    next(httpError(401, "Not authorized"));
  }
  const token = jwt.sign(
    { auth_id: prismaStore.auth_id, store_id: prismaStore.store_id },
    AUTH_TOKEN_SECRET_KEY,
    {
      expiresIn: "1m",
    }
  );

  const updateStore = await prisma.Store.update({
    where: {
      auth_id: auth_id,
    },
    data: {
      token: token,
    },
  });

  res.json({
    message: "token refreshed",
    token: updateStore.token,
  });
};

const logInStore = async (req, res, next) => {
  console.log('logInStore invoke')
  const { login, password } = req.body;
  console.log('login', login)
  const store = await prisma.Store.findUnique({ where: { auth_id: login } });
  if (!store) {
    return httpError(401);
  }

  const checkPassword = await bcrypt.compare(password, store.password);

  if (!checkPassword) {
    return httpError(401);
  }
  const token = jwt.sign(
    { auth_id: store.auth_id, store_id: store.id },
    AUTH_TOKEN_SECRET_KEY,
    {
      expiresIn: "1m",
    }
  );
  const refreshToken =  jwt.sign(
    { auth_id: store.auth_id, store_id: store.id },
    REFRESH_TOKEN_SECRET_KEY,
    { expiresIn: "1d" }
  );
  const updateStore = await prisma.Store.update({
    where: {
      auth_id: login,
    },
    data: {
      token: token,
    },
  });

  res.json({
    message: "success",
    store_id: updateStore.id,
    auth_id: updateStore.auth_id,
    token: updateStore.token,
    refreshToken,
    role: updateStore.role
    
  });
};

const logoutStore = async (req, res, next) => {
  const { store_id } = req.store;

  const store = await prisma.Store.findUnique({
    where: { store_id: store_id },
  });
  if (!store) {
    next(httpError(401));
  }
  await prisma.Store.update({
    where: {
      store_id: store_id,
    },
    data: {
      token: "",
      isLoggedIn: false,
    },
  });
  res.status(200).json({
    message: "Logout success",
  });
};
module.exports = {
  logInStore: ctrlWrapper(logInStore),
  logoutStore: ctrlWrapper(logoutStore),
  refreshToken: ctrlWrapper(refreshToken),
};
