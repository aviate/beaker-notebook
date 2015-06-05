(ns bunsen.common.component.database
  (:require [datomic.api :as d :refer [q]]
            [clojure.edn :as edn]
            [io.rkn.conformity :as c]
            [clojure.java.io :as io]
            [com.stuartsierra.component :as component :refer [start stop]]
            [bunsen.common.protocol.seedable :as seedable :refer [seed! unseed!]]))

(defn read-resource-file [file]
  (->> file io/resource slurp))

(defn migrations [file]
  (->> file
       read-resource-file
       (edn/read-string {:readers *data-readers*})))

(defn migrate [conn file]
  (c/ensure-conforms conn (migrations file)))

(defn seed-data [file readers]
  (->> file
       read-resource-file
       (edn/read-string {:readers (merge *data-readers* readers)})))

(defrecord Database [config]
  component/Lifecycle

  (start [database]
         (if (:conn database)
           database
           (let [uri (:database-uri config)]
             (d/create-database uri)
             (let [conn (d/connect uri)
                   seed (:seed-file config)
                   readers (:seed-readers config)]
               (migrate conn "migrations.edn")
               (if seed (d/transact conn (seed-data seed readers)))
               (assoc database :conn conn)))))

  (stop [database]
        (when-let [conn (:conn database)]
          (d/release conn))
        (dissoc database :conn))

  seedable/Seedable

  (unseed! [database]
    (let [uri (:database-uri config)]
      (d/delete-database uri)
      (d/create-database uri)
      (migrate (d/connect uri) "migrations.edn"))))

(defn database [config]
  (map->Database {:config config}))