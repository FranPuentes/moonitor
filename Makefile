
clean:
	find . -name \*~ -delete
	rm -f *.log
	rm -f *.pid

pull:
	rm -f *.tgz
	git pull

commit: clean
	git commit -a

tgz:
	tar czvf moon-broker.tgz broker moon-broker.js common modules web deps/daemon.node-master deps/jquery*
	tar czvf moon-daemon.tgz daemon moon-daemon.js common plugins     deps/daemon.node-master

push: tgz commit
	git push https://github.com/FranPuentes/moonitor.git


