console.log('start')



let player_health_point = 100
let player_speed = 100
let player_damage = 5
let player_jump = 10

let player_weapon = 'longsword'
let player_amulets = []

const weapons = ['longsword', 'dagger', '']


class Boss {
    constructor(name, boss_health_point, boss_damage) {
        this.name = name
        this.boss_health_point = boss_health_point
        this.boss_damage = boss_damage
        this.boss_attack_status = this.boss_attack_status
        this.boss_attack_delay = this.boss_attack_delay
    }

    boss_attack() {
        this.boss_attack_status = 'wind-up'
        console.log(player_health_point)
        // delay
        player_health_point -= this.boss_damage
        console.log(player_health_point)
    }
}



const Boss1 = new Boss('Boss1', 200, 25, 'Ready', 100)