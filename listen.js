import { checkERC721, ERC721, writeLog } from "./utils.js"
import { createAlchemyWeb3 } from "@alch/alchemy-web3"
import { LoadingAnimation } from "./Loading.js"
import { sendEmail } from "./send_mail.js"
import { etherscan } from "./etherscan.js"
import { printBanner } from "./banner.js"
import { ethers } from "ethers"
import dotenv from "dotenv"

dotenv.config("./.env")

const arg = process.argv.slice(2)
const TARGET_ADDRESS = arg[0]
const FOLLOW_AMOUNT = arg[1]

if (!arg[0]) {
  console.log("please input target address!")
  process.exit(1)
}
if (!arg[1]) {
  console.log("please set follow amount!")
  process.exit(1)
}

// config the loading animation
const loader = new LoadingAnimation(`monitoring...`)

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
        label: "🔣 Max Amount",
        content: FOLLOW_AMOUNT,
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
      if (!err) {
        loader.stop()
        if (txInfo !== null) {
          if (txInfo.from.toLowerCase() === address.toLowerCase()) {
            console.log(txInfo.hash)
            if (Number(txInfo.value) == "0") {
              try {
                console.log("getting abi...")
                let abi = await etherscan.getABIbyContractAddress(txInfo.to)
                if (checkERC721(abi)) {
                  console.log(
                    `it's a ERC721 tx, contract address: ${txInfo.to}`
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
                    if (!paramIncludesAddress) {
                      let txLoader = new LoadingAnimation(
                        "sending transaction..."
                      )
                      let minted_amount = 0
                      for (let hash of minted){
                        if (hash == txInfo.to) minted_amount++
                      }
                      console.log(minted_amount)
                      if (minted_amount < FOLLOW_AMOUNT) {
                        try {
                          txLoader.start()
                          let follow_tx = await wallet.sendTransaction({
                            to: txInfo.to,
                            gasLimit: txInfo.gas,
                            data: txInfo.input,
                            maxPriorityFeePerGas: txInfo.maxPriorityFeePerGas,
                            maxFeePerGas: txInfo.maxFeePerGas,
                            value: 0,
                          })
                          txLoader.stop()
                          console.log(
                            `success! check the transaction info: https://etherscan.io/tx/${follow_tx.hash}`
                          )
                          minted.push(txInfo.to)
                          console.log(follow_tx)
                          // write the logs
                          const time = new Date()
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
                            await sendEmail(network, follow_tx.hash)
                          }
                          loader.start()
                        } catch (error) {
                          console.error(error)
                        }
                      } else {
                        console.log("already minted this nft")
                        loader.start()
                      }
                    } else {
                      console.log(
                        "param includes address, we can't resolve it yet"
                      )
                      loader.start()
                    }
                  } else {
                    console.log(`it's not a minting method`)
                    loader.start()
                  }
                } else {
                  console.log(`it's not a ERC721 tx`)
                  loader.start()
                }
              } catch (error) {
                console.error(error)
              }
            } else {
              console.log(`it's not a free tx`)
              loader.start()
            }
          }
        }
      }
    }
  )
}

main().catch((err) => console.log(err))
