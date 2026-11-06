-- Dados de demonstração. Não representam estoque oficial do PET.
INSERT OR IGNORE INTO categorias(nome,ordem) VALUES ('Eletrônica',1),('Papelaria',2),('Ferramentas',3),('Equipamentos',4),('Mecânica',5);
INSERT INTO componentes(categoria_id,nome,identificacao,patrimonio,quantidade,em_uso,com_defeito,mostrar_quantidade,mostrar_em_uso,mostrar_defeito,descricao_defeito)
SELECT id,'ESP32 DevKit V1 (EXEMPLO)','30 pinos','DEMO-001',20,5,2,1,1,1,'Duas placas apresentam falha de conexão.'
FROM categorias WHERE nome='Eletrônica' AND NOT EXISTS(SELECT 1 FROM componentes WHERE nome='ESP32 DevKit V1 (EXEMPLO)');
INSERT INTO componentes(categoria_id,nome,identificacao,patrimonio,quantidade,em_uso,com_defeito,mostrar_quantidade,mostrar_em_uso,mostrar_defeito)
SELECT id,'Caneta esferográfica (EXEMPLO)','Cor azul','DEMO-002',40,8,0,1,1,0
FROM categorias WHERE nome='Papelaria' AND NOT EXISTS(SELECT 1 FROM componentes WHERE nome='Caneta esferográfica (EXEMPLO)');
INSERT INTO componentes(categoria_id,nome,identificacao,patrimonio,quantidade,em_uso,com_defeito,mostrar_quantidade,mostrar_em_uso,mostrar_defeito,descricao_defeito)
SELECT id,'Chave de fenda (EXEMPLO)','Ponta cruzada','DEMO-003',8,2,1,1,1,1,'Uma unidade apresenta cabo rachado.'
FROM categorias WHERE nome='Ferramentas' AND NOT EXISTS(SELECT 1 FROM componentes WHERE nome='Chave de fenda (EXEMPLO)');
INSERT INTO componentes(categoria_id,nome,identificacao,patrimonio,quantidade,em_uso,com_defeito,mostrar_quantidade,mostrar_em_uso,mostrar_defeito,descricao_defeito)
SELECT id,'Tablet de demonstração','Identificação 22','DEMO-004',5,1,1,1,1,1,'Uma unidade apresenta falha na bateria.'
FROM categorias WHERE nome='Equipamentos' AND NOT EXISTS(SELECT 1 FROM componentes WHERE nome='Tablet de demonstração');
INSERT INTO componentes(categoria_id,nome,identificacao,patrimonio,quantidade,em_uso,com_defeito,mostrar_quantidade,mostrar_em_uso,mostrar_defeito,descricao_defeito)
SELECT id,'Motor DC 3–6 V (EXEMPLO)','Caixa de redução amarela','DEMO-005',20,5,2,1,1,1,'Alguns motores apresentam falha no eixo.'
FROM categorias WHERE nome='Mecânica' AND NOT EXISTS(SELECT 1 FROM componentes WHERE nome='Motor DC 3–6 V (EXEMPLO)');
