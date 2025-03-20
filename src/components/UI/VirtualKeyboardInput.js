import React, { useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

const VirtualKeyboardInput = ({input, setInput}) => {
    // const [input, setInput] = useState("");
    const [showKeyboard, setShowKeyboard] = useState(false);

    const handleChange = (event) => {
        setInput(event.target.value);
    };

    const onKeyPress = (button) => {
        if (button === "{bksp}") {
            setInput(input.slice(0, -1)); // Remove last character
        } else if (button === "{space}") {
            setInput(input + " "); // Add space
        } else if (button === "{enter}") {
            setShowKeyboard(false); // Hide keyboard on enter
        } else {
            setInput(input + button);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
            {/* Input Field */}
            <input
                type="password"
                value={input}
                onFocus={() => setShowKeyboard(true)}
                onChange={handleChange}
                placeholder="Tap to type..."
                style={{ width: "100%", fontSize: "12px", padding: "10px" }}
            />

            {/* Virtual Keyboard (Shows Only When Input is Focused) */}
            {showKeyboard && (
                <div style={{ position: "absolute", bottom: "0px", width: "100%", height: '200px' }}>
                    <Keyboard
                        onKeyPress={onKeyPress}
                        layout={{
                            default: [
                                "! @ # $ % ^ & * ( )",
                                "1 2 3 4 5 6 7 8 9 0",
                                "q w e r t y u i o p [ ]",
                                "a s d f g h j k l ; '",
                                "z x c v b n m , . ?",
                                "{bksp} {enter}"
                            ]
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default VirtualKeyboardInput;
