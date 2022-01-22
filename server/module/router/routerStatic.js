const express = require('express')
const routerStatic = express.Router()
const path = require("path")
const MIME = require('../../config/MIME')
const {isExist} = require('../util')
const fs = require("fs")

const resolvePath = path.resolve()

routerStatic.get('/:filename', async (req, res) => {
  const {filename} = req.params
  // 文件路径 + 文件名 = 完整路径
  const filePath = path.join(resolvePath, `public/${filename}`)
  if (!isExist(filePath)) return res.send('找不到文件')
  // 获取文件后缀
  const extname = path.extname(filename).toLowerCase()
  res.setHeader('Content-Type', `${MIME[extname]}`)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  // Content-Disposition 需要转换 encodeURIComponent
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`)
  res.send(await fs.readFileSync(filePath))
})

module.exports = routerStatic
