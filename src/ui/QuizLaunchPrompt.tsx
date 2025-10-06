export default function QuizLaunchPrompt() {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',    // do not block UI
                zIndex: 500,
            }}
        >
            <div
                style={{
                    fontWeight: 900,
                    letterSpacing: 2,
                    fontSize: 'min(6vw, 64px)',
                    color: '#66e0ff',
                    textShadow: '0 4px 30px rgba(102,224,255,0.35)',
                    opacity: 0.9,
                    userSelect: 'none'
                }}
            >
                LAUNCH METEOR TO START QUIZ
            </div>
        </div>
    )
}
