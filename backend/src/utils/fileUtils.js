const fs = require('fs');
const path = require('path');

/**
 * 将JSON数据写入本地文件
 * @param {string} fileName - 文件名（不含扩展名）
 * @param {string} dirPath - 存储目录路径
 * @param {any} data - 要存储的JSON数据
 * @returns {Promise<string>} - 返回保存的文件完整路径
 */
async function saveJsonToFile(fileName, dirPath, data) {
  return new Promise((resolve, reject) => {
    // 确保目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // 拼接完整路径
    const fullPath = path.join(dirPath, `${fileName}.json`);

    // 写入文件
    fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(fullPath);
      }
    });
  });
}

module.exports = { saveJsonToFile };
