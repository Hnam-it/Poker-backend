const getAdminInfo = (req, res) => {
  res.json({ message: 'Welcome admin!', user: req.user });
};

module.exports = {
  getAdminInfo,
};
