import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
    initialValue: string;
    onSave: (newValue: string) => void;
    className?: string;
    as?: 'h1' | 'h2' | 'p' | 'div';
    isHtml?: boolean;
}

export const EditableText: React.FC<EditableTextProps> = ({
    initialValue,
    onSave,
    className = '',
    as: Component = 'div',
    isHtml = false,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialValue);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSave = () => {
        if (value !== initialValue) {
            onSave(value);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setValue(initialValue);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing, value]);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    if (isEditing) {
        return (
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                    }
                }}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`${className} w-full bg-pearl border-l-2 border-editorial-gold p-2 -m-1 resize-none focus:outline-none focus:border-ink text-ink transition-colors`}
                style={{ overflow: 'hidden' }}
            />
        );
    }

    const commonProps = {
        className: `${className} cursor-pointer hover:bg-pearl p-1 -m-1 border-l-2 border-transparent hover:border-editorial-gold transition-all`,
        onClick: () => setIsEditing(true),
    };

    if (isHtml) {
        return (
            <Component
                {...commonProps}
                dangerouslySetInnerHTML={{ __html: initialValue }}
            />
        );
    }

    return (
        <Component {...commonProps}>
            {initialValue}
        </Component>
    );
};
