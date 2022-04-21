import Player from 'play-sound'

export const playSound = async () => {
  const player = Player({})
  player.play('./alarm/alarm.mp3')
}