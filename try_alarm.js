import Player from 'play-sound'

const main = async () => {
  const player = Player({})
  player.play('./alarm/alarm.mp3')

}
main()
