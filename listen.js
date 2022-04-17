import { createAlchemyWeb3 } from "@alch/alchemy-web3"
import { LoadingAnimation } from "./Loading.js"
import { sendEmail } from "./send_mail.js"
import { etherscan } from "./etherscan.js"
import { printBanner } from "./banner.js"
import { ethers } from "ethers"
import dotenv from "dotenv"
import chalk from "chalk"
import {
  checkERC721,
  ERC721,
  writeLog,
  getMinted,
  writeMinted,
} from "./utils.js"

dotenv.config("./.env")

const arg = process.argv.slice(2)
let TARGET_ADDRESS = ""
let PAYABLE = false

if (!arg[0]) {
  console.log("please input target address!")
  process.exit(1)
} else {
  if (ethers.utils.isAddress(arg[0])) TARGET_ADDRESS = arg[0]
  else {
    console.log(chalk.red("invalid address!"))
    process.exit(1)
  }
}

if (arg[1] == "payable") PAYABLE = true
else {
  if (arg[1] == "free" || arg[1] == null) PAYABLE = false
  else {
    console.log(chalk.red(`can't resolve argument: '${arg[1]}'`))
    process.exit(1)
  }
}

if (arg[2]) {
  console.log(chalk.red(`too many arguments!`))
  process.exit(1)
}

// config the loading animation
const loader = new LoadingAnimation(`🕵️‍♀️  monitoring...`)

const main = async () => {
  console.clear()
  alchemy_subscribe("mainnet", TARGET_ADDRESS)
}

/**
 *
 * @param {string} network chain network
 * @param {string} address the address you are gonna listen to
 */
const alchemy_subscribe = async (network, address) => {
  let alchemy_url_1 = `wss://eth-${network}.alchemyapi.io/v2/${process.env.ALCHEMY_KEY1}`
  let alchemy_url_2 = `https://eth-${network}.alchemyapi.io/v2/${process.env.ALCHEMY_KEY2}`
  let web3 = createAlchemyWeb3(alchemy_url_1)
  const provider = new ethers.providers.JsonRpcProvider(alchemy_url_2)

  let wallet
  if (network == "mainnet")
    wallet = new ethers.Wallet(process.env.MAINNET_PRIVATE_KEY, provider)

  if (network == "rinkeby")
    wallet = new ethers.Wallet(process.env.RINKEBY_PRIVATE_KEY, provider)
  // config the banner
  printBanner(
    `Monitoring Info`,
    [
      {
        label: "🌎 Current Network",
        content: network,
      },
      {
        label: "👻 Mode",
        content: PAYABLE ? "payable" : "free",
      },
      {
        label: "👛 Current Main Wallet",
        content: await wallet.getAddress(),
      },
      {
        label: "💰 Wallet Balance",
        content: `${ethers.utils.formatEther(await wallet.getBalance())}Ξ`,
      },
      {
        label: "💻 Monored Address",
        content: address,
      },

      {
        label: "📧 E-mail",
        content: `${process.env.EMAIL_ACCOUNT}@qq.com`,
      },
    ],
    80
  )
  loader.start()
  let minted = []
  web3.eth.subscribe(
    "alchemy_filteredFullPendingTransactions",
    {
      address: address,
    },
    async (err, txInfo) => {
      const time = new Date()
      if (!err) {
        loader.stop()
        if (txInfo !== null) {
          if (txInfo.from.toLowerCase() === address.toLowerCase()) {
            console.log(
              `${"-".repeat(40)} ${time.toLocaleString()} ${"-".repeat(40)}`
            )
            console.log(`🔍 Found a transaction: ${txInfo.hash}`)
            if (Number(txInfo.value) == "0" || PAYABLE) {
              if (ethers.utils.formatEther(txInfo.value) <= 0.1) {
                try {
                  console.log("🤖 getting abi...")
                  let abi = await etherscan.getABIbyContractAddress(txInfo.to)
                  if (checkERC721(abi)) {
                    console.log(
                      `🤑 it's an ERC721 tx, contract address: ${chalk.green(
                        txInfo.to
                      )}`
                    )
                    const contract = new ethers.Contract(txInfo.to, abi, wallet)
                    let method = contract.interface.getFunction(
                      txInfo.input.slice(0, 10)
                    )
                    if (!ERC721.includes(method.name)) {
                      let paramIncludesAddress = false
                      method.inputs.forEach((param) => {
                        if (param.type == "address") paramIncludesAddress = true
                      })
                      if (!paramIncludesAddress && method.inputs.length == 1) {
                        if (txInfo.input.slice(txInfo.input.length - 2) <= 4) {
                          let mintedAddress = await getMinted()
                          if (!mintedAddress.includes(txInfo.to)) {
                            try {
                              writeMinted(txInfo.to)
                              console.log("🚚 sending transaction...")
                              let follow_tx = await wallet.sendTransaction({
                                to: txInfo.to,
                                gasLimit: txInfo.gas,
                                data: txInfo.input,
                                maxPriorityFeePerGas:
                                  txInfo.maxPriorityFeePerGas,
                                maxFeePerGas: txInfo.maxFeePerGas,
                                value: txInfo.value,
                              })
                              await follow_tx.wait()
                              console.log(
                                chalk.green(
                                  `✅ success! check the transaction info: https://etherscan.io/tx/${follow_tx.hash}`
                                )
                              )
                              minted.push(txInfo.to)
                              // write the logs
                              writeLog(TARGET_ADDRESS, {
                                contractAddress: txInfo.to,
                                txHash: txInfo.hash,
                                time: time.toLocaleString(),
                              })
                              // send email
                              if (
                                process.env.EMAIL_ACCOUNT &&
                                process.env.EMAIL_PASSWARD
                              ) {
                                try {
                                  await sendEmail(
                                    `<b>MINT 成功, 下方链接跳转etherscan</b><p>https://${
                                      network == "mainnet" ? "" : network + "."
                                    }etherscan.io/tx/${txInfo.hash}</p>`
                                  )
                                  console.log("📧 Mail sending successed!")
                                } catch (error) {
                                  console.log("❌ Mail sending failed!")
                                }
                              }
                              loader.start()
                            } catch (error) {
                              console.error(error.message)
                            }
                          } else {
                            console.log(
                              chalk.red("❌ this nft has been minted")
                            )
                            loader.start()
                          }
                        } else {
                          console.log(
                            chalk.red("❌ minting amount is more than 4")
                          )
                          loader.start()
                        }
                      } else {
                        console.log(
                          chalk.red(
                            "❌ param includes address, we can't resolve it yet / function has more than 1 params, we can't resolve it too"
                          )
                        )
                        await sendEmail(
                          `<b>该交易可能需要前端mint,请自行检查!下方链接跳转etherscan</b><p>https://${
                            network == "mainnet" ? "" : network + "."
                          }etherscan.io/tx/${txInfo.hash}</p>`
                        )
                        console.log("📧 Mail sending successed!")
                        loader.start()
                      }
                    } else {
                      console.log(chalk.red(`❌ it's not a minting method`))
                      loader.start()
                    }
                  } else {
                    console.log(chalk.red(`❌ it's not an ERC721 tx`))
                    loader.start()
                  }
                } catch (error) {
                  console.error(error)
                }
              } else {
                console.log(chalk.red("❌ tx value is more than 0.1E"))
                loader.start()
              }
            } else {
              console.log(chalk.red(`❌ it's not a free tx`))
              loader.start()
            }
          }
        }
      }
    }
  )
}

main().catch((err) => console.log(err))
