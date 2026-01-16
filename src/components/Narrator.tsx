import React, { useEffect } from 'react';

const Narrator: React.FC<{ text: string; autoPlay?: boolean }> = ({ text, autoPlay = false }) => {
    const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        if (autoPlay && text) {
            speak();
        }
    }, [autoPlay, text]);

    return <button onClick={speak}>🔊</button>;
};

export default Narrator;