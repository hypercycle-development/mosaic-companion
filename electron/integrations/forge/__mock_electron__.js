
module.exports = {
  app: {
    getPath: (name) => {
      if (name === "userData") return "/tmp/mosaic-test-1778956216124";
      if (name === "temp") return "/tmp";
      return os.tmpdir();
    }
  }
};
