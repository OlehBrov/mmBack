const fs = require("fs/promises");
const path = require("path");
const dataPath = path.join(__dirname, "..", "data", "test.json");


const readFileData = async (file) => {
  //   try {
  const dataFile = await fs.readFile(file, "utf-8");
  displayFile(dataFile);
  //   } catch (error) {
  // console.log(error.message);
  //   }
};

const createFileData = async (filepath, data) => {
  try {
    return await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(error.message);
  }
};

const updateFileData = async (path, data) => {
  try {
    const fileData = JSON.parse(await fs.readFile(dataPath, "utf-8"));
    const updatedData = [...fileData, data];
    return await createFileData(dataPath, updatedData);
  } catch (error) {}
};

const removeFileData = async () => {};

const displayFile = async (file) => {
  await console.log(file);
};
const writeData = [
  {
    _id: "65f09f39c99c373464bc8e8c",
    index: 0,
    guid: "34370bda-45bc-434e-bbd2-ebfa1371b13d",
    isAvailable: false,
    total: 474,
    picture: "http://placehold.it/32x32",
    category: "<ReferenceError: coffee is not defined>",
    name: "non",
    description:
      "Officia voluptate commodo est labore ullamco duis irure. Enim tempor et duis exercitation non cupidatat amet nulla incididunt deserunt culpa cillum laboris.",
    price: 97.37,
    shopId: 12,
    storage: "lviv",
    saleDates: "[]",
  },
  {
    _id: "65f09f39d74ea94aadc531f1",
    index: 1,
    guid: "1c52ce33-0eb5-48a4-a3bf-f1832597cffc",
    isAvailable: true,
    total: 195,
    picture: "http://placehold.it/32x32",
    category: "<ReferenceError: coffee is not defined>",
    name: "veniam",
    description:
      "Sit adipisicing sint duis est minim. Ad exercitation incididunt eiusmod exercitation dolor irure et exercitation aliquip non minim est ex et.",
    price: 60.34,
    shopId: 13,
    storage: "kharkiv",
    saleDates: "[]",
  },
];

const updateData = {
  _id: "65f09f390945bd837893fe3e",
  index: 4,
  guid: "a25a63cd-84f4-455b-90c7-2048515b5e0c",
  isAvailable: true,
  total: 186,
  picture: "http://placehold.it/32x32",
  category: "<ReferenceError: coffee is not defined>",
  name: "consequat",
  description:
    "Cupidatat cupidatat in ad commodo sint. Culpa fugiat incididunt ullamco veniam.",
  price: 22.76,
  shopId: 14,
  storage: "kyiv",
  saleDates: "[]",
};
// readFileData(dataPath);
// createFileData(dataPath, writeData)
// updateFileData(dataPath, updateData)

const tryCatchHandler = async (clb) => {
  try {
    await clb;
  } catch (error) {
    console.log(error.message);
  }
};

// tryCatchHandler(readFileData(dataPath));
