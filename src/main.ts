import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {

    document.fonts.ready
        .then(() => StartGame('game-container'))
        .catch(() => StartGame('game-container'));

});
