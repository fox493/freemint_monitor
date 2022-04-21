import dotenv from "dotenv"
import sound from 'sound-play'
dotenv.config(".env")

const main = async () => {
  sound.play('./alarm/alarm_haoyunlai.mp3')
}

main()
