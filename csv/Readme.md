In this folder the system creates database files to save data. There is one main database where general information about all experiments is saved. Then, in an additional folder there is one database file for ewach experiment. In these files the experiment data is saved. This architecture was chosen to prevent any concurrent calls to the database when executing multiple runs at once (multiprocessing). The databases are using sqlite3. 