import fs from "fs"

export const ERC721 = [
  "balanceOf",
  "ownerOf",
  "safeTransferFrom",
  "safeTransferFrom",
  "transferFrom",
  "approve",
  "setApprovalForAll",
  "getApproved",
  "isApprovedForAll",
]
export const checkERC721 = (resString) => {
  try {
    const abi = JSON.parse(resString)
    let funcNames = []
    for (let func of abi) funcNames.push(func.name)
    for (let inter of ERC721) {
      if (!funcNames.includes(inter)) return false
    }
    return true
  } catch (error) {
    return false
  }
}

export const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms))
}

export const writeLog = (address, tx) => {
  let path = `./logs/logs_${address}.json`
  if (!fs.existsSync(path)) {
    let log = {
      monoredAddress: address,
      txLogs: [tx],
    }
    fs.writeFile(path, JSON.stringify(log,null,4), () => {
      console.log(`successful writting the log in ${path}`)
    })
  } else {
    fs.readFile(path, (err, data) => {
      if (err) console.error(err)
      let log = JSON.parse(data)
      log.txLogs.push(tx)
      fs.writeFile(path, JSON.stringify(log,null,4), () => {
        console.log(`successful editting the log in ${path}`)
      })
    })
  }
}
