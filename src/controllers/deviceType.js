import prisma from "../lib/prisma";

const create = async (req, res) => {
    if (!req.body.name && !req.body.make) {
        res.status(400).send({ message: "Content can not be empty!" });
    }

    const { name, make  } = req.body;

    try {
        const deviceType = prisma.deviceType.create({
          name, make
      })
        res.status(201).json({
          message:"User registered successfully!!",
          deviceType
        })
    } catch(error) {
        res.status(500).json(error.message)
    }
};

export { create };