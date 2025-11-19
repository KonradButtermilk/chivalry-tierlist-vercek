-- Tabela graczy
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wyczyszczenie tabeli (opcjonalne - odkomentuj jeśli chcesz zresetować dane przy ponownym uruchomieniu)
-- TRUNCATE TABLE players;

-- Dane początkowe z Tier Listy
INSERT INTO players (name, tier) VALUES 
-- Tier 1
('Anka', 1),
('Wondy', 1),
('Macik', 1),
('Fritz', 1),
('Doomer', 1),
('Teddo', 1),
('DikAleks', 1),
('Watermark', 1),
('mkay', 1),
('gilgamesh', 1),
('astro', 1),

-- Tier 2
('Netto', 2),
('Bonk', 2),
('Wes', 2),
('bb willetz', 2),
('nkvd serafin', 2),
('slavak', 2),
('gadza', 2),
('marsilion', 2),

-- Tier 3
('Chungus Cluegi', 3),
('Ragnar', 3),
('Leonardo', 3),
('Godefroy', 3),
('Fearzing', 3),
('Alcor', 3),

-- Tier 4
('RobertDDI', 4),
('Absdulah', 4),
('bearded snake', 4),
('BigF', 4),
('proptt', 4),

-- Tier 5
('RapidSna1l', 5),
('TowarzyszSkipper', 5);
