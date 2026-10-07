import { useState } from 'react';

function Accordion({ items = [], defaultOpen = 0 }) {
    const [open, setOpen] = useState(defaultOpen);

    const toggle = (index) => setOpen((prev) => (prev === index ? -1 : index));

    return (
        <div className="ui-accordion">
            {items.map((item, index) => {
                const isOpen = open === index;
                return (
                    <div
                        key={item.q}
                        className={`ui-accordion__item ${isOpen ? 'is-open' : ''}`}
                    >
                        <button
                            type="button"
                            className="ui-accordion__head"
                            onClick={() => toggle(index)}
                            aria-expanded={isOpen}
                        >
                            <span className="ui-accordion__q">{item.q}</span>
                            <span className="ui-accordion__icon" aria-hidden="true" />
                        </button>
                        <div className="ui-accordion__panel">
                            <div className="ui-accordion__inner">{item.a}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default Accordion;